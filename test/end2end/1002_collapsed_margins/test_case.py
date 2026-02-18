import os

from seleniumbase import BaseCase

from test.end2end.helpers.helper import Helper

path_to_this_test_file_folder = os.path.dirname(os.path.abspath(__file__))

starts_2 = '//*[@data-testid="starts_2"]';
starts_3 = '//*[@data-testid="starts_3"]';
starts_4 = '//*[@data-testid="starts_4"]';
ends_2 = '//*[@data-testid="ends_2"]';
ends_3 = '//*[@data-testid="ends_3"]';
# child = '//*[@data-testid="child"]';
child_2 = '//*[@data-testid="child_2"]';
child_3 = '//*[@data-testid="child_3"]';

class Test(BaseCase):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.helper = Helper(self)

    @staticmethod
    def check_elements_3pages(helper):
        helper.assert_html2pdf4doc_success()
        helper.assert_document_has_pages(3)
        helper.assert_element_starts_page(starts_2, 2)
        helper.assert_element_on_the_page(ends_2, 2)
        helper.assert_element_starts_page(starts_3, 3)

    @staticmethod
    def check_elements_4pages(helper):
        helper.assert_html2pdf4doc_success()
        helper.assert_document_has_pages(4)
        helper.assert_element_starts_page(starts_2, 2)
        helper.assert_element_on_the_page(ends_2, 2)
        helper.assert_element_starts_page(starts_3, 3)
        helper.assert_element_on_the_page(ends_3, 3)
        helper.assert_element_starts_page(starts_4, 4)

    @staticmethod
    def check_chain(helper):
        helper.assert_elements_attribute_not_contains(
            'expected-zeroed-margin-top="false"',
            'style',
            "margin-top: 0px !important;"
        )
        helper.assert_elements_attribute_not_contains(
            'expected-zeroed-margin-bottom="false"',
            'style',
            "margin-bottom: 0px !important;"
        )
        helper.assert_elements_attribute_contains(
            'expected-zeroed-margin-top="true"',
            'style',
            "margin-top: 0px !important;"
        )
        helper.assert_elements_attribute_contains(
            'expected-zeroed-margin-bottom="true"',
            'style',
            "margin-bottom: 0px !important;"
        )

    # base behavior
    def test_chain_base(self):
        self.helper.open_case(path_to_this_test_file_folder, 'chain_base')
        self.check_elements_4pages(self.helper)

    def test_chain_base_negative_margin(self):
        self.helper.open_case(path_to_this_test_file_folder, 'chain_base_negative_margin')
        self.check_elements_4pages(self.helper)

    def test_chain_child_absolute(self):
        self.helper.open_case(path_to_this_test_file_folder, 'chain_child_absolute')
        self.check_elements_4pages(self.helper)
        self.check_chain(self.helper)

    def test_chain_child_float(self):
        self.helper.open_case(path_to_this_test_file_folder, 'chain_child_float')
        self.check_elements_4pages(self.helper)
        self.check_chain(self.helper)

    def test_chain_child_clear_float(self):
        self.helper.open_case(path_to_this_test_file_folder, 'chain_child_clear_float')
        self.check_elements_3pages(self.helper)
        self.check_chain(self.helper)

    def test_chain_child_inline(self):
        self.helper.open_case(path_to_this_test_file_folder, 'chain_child_inline')
        self.check_elements_4pages(self.helper)
        self.check_chain(self.helper)

    def test_chain_child_mid_padding(self):
        self.helper.open_case(path_to_this_test_file_folder, 'chain_child_mid_padding')
        self.check_elements_4pages(self.helper)
        self.check_chain(self.helper)

    def test_chain_parent_border(self):
        self.helper.open_case(path_to_this_test_file_folder, 'chain_parent_border')
        self.check_elements_4pages(self.helper)
        self.check_chain(self.helper)

    def test_chain_parent_padding(self):
        self.helper.open_case(path_to_this_test_file_folder, 'chain_parent_padding')
        self.check_elements_4pages(self.helper)
        self.check_chain(self.helper)


    # known‑limitations
    # TODO test/end2end/1002_collapsed_margins/not_implemented_TODO/

    # def test_negative_margin_compensation(self):
    #     self.helper.open_case(path_to_this_test_file_folder, 'negative_margin_compensation')

    # def test_relative_compensation(self):
    #     self.helper.open_case(path_to_this_test_file_folder, 'relative_compensation')

    # def test_transform_compensation(self):
    #     self.helper.open_case(path_to_this_test_file_folder, 'transform_compensation')

    # def test_negative_margin_compensation_bottom(self):
    #     self.helper.open_case(path_to_this_test_file_folder, 'negative_margin_compensation_bottom')

    # def test_relative_compensation_bottom(self):
    #     self.helper.open_case(path_to_this_test_file_folder, 'relative_compensation_bottom')

    # def test_transform_compensation_bottom(self):
    #     self.helper.open_case(path_to_this_test_file_folder, 'transform_compensation_bottom')
